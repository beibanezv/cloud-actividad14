package com.kafka.streams;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.DynamodbEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kafka.streams.DTO.CamionTelemetryDTO;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.apigatewaymanagementapi.ApiGatewayManagementApiClient;
import software.amazon.awssdk.services.apigatewaymanagementapi.model.PostToConnectionRequest;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class TelemetryStreamHandler implements RequestHandler<DynamodbEvent, Void> {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DynamoDbClient dynamoDb = buildClient();

    private static DynamoDbClient buildClient() {
        String endpoint = System.getenv("DYNAMODB_ENDPOINT");
        if (endpoint != null && !endpoint.isEmpty()) {
            return DynamoDbClient.builder()
                    .endpointOverride(java.net.URI.create(endpoint))
                    .region(software.amazon.awssdk.regions.Region.US_EAST_1)
                    .credentialsProvider(software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
                            software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create("test", "test")))
                    .build();
        }
        return DynamoDbClient.create();
    }
    // URL de API Gateway WebSocket del Mensajero. Configurar como variable de entorno
    // WEBSOCKET_API_ENDPOINT en la Lambda Streams (ej: https://tu-api-id.execute-api.us-east-1.amazonaws.com/prod)
    private final String webSocketApiEndpoint = System.getenv("WEBSOCKET_API_ENDPOINT");

    @Override
    public Void handleRequest(DynamodbEvent event, Context context) {
        if (event == null || event.getRecords() == null) {
            context.getLogger().log("El evento recibido de DynamoDB Stream es nulo.");
            return null;
        }
        context.getLogger().log("Procesando " + event.getRecords().size() + " eventos desde DynamoDB Stream...");
        List<CamionTelemetryDTO> telemetryBatch = new ArrayList<>();
        for (DynamodbEvent.DynamodbStreamRecord record : event.getRecords()) {
            if ("INSERT".equals(record.getEventName()) || "MODIFY".equals(record.getEventName())) {
                Map<String, com.amazonaws.services.lambda.runtime.events.models.dynamodb.AttributeValue> newImage = record.getDynamodb().getNewImage();
                if (newImage != null && !newImage.isEmpty()) {
                    telemetryBatch.add(mapToDTO(newImage));
                }
            }
        }
        if (!telemetryBatch.isEmpty()) {
            broadcastTelemetry(telemetryBatch, context);
        }
        return null;
    }

    private CamionTelemetryDTO mapToDTO(Map<String, com.amazonaws.services.lambda.runtime.events.models.dynamodb.AttributeValue> image) {
        CamionTelemetryDTO dto = new CamionTelemetryDTO();
        if (image.get("id") != null) dto.setId(image.get("id").getS());
        if (image.get("id_camion") != null) dto.setCamionId(image.get("id_camion").getS());
        if (image.get("timestamp") != null) dto.setTimestamp(Long.valueOf(image.get("timestamp").getN()));
        if (image.get("temperatura") != null) dto.setTemperatura(Double.valueOf(image.get("temperatura").getN()));
        if (image.get("humedad") != null) dto.setHumedad(Double.valueOf(image.get("humedad").getN()));
        if (image.get("estado") != null) dto.setEstado(image.get("estado").getS());
        return dto;
    }

    private void broadcastTelemetry(List<CamionTelemetryDTO> batch, Context context) {
        try {
            if (webSocketApiEndpoint == null || webSocketApiEndpoint.isEmpty()) {
                context.getLogger().log("Error: La variable de entorno WEBSOCKET_API_ENDPOINT no está configurada.");
                return;
            }
            String jsonPayload = objectMapper.writeValueAsString(batch);
            context.getLogger().log("Transmitiendo " + batch.size() + " elementos de telemetría (Broadcast)...");
            ApiGatewayManagementApiClient apiGatewayClient = ApiGatewayManagementApiClient.builder()
                    .endpointOverride(URI.create(webSocketApiEndpoint))
                    .region(software.amazon.awssdk.regions.Region.US_EAST_1)
                    .build();
            for (String connectionId : getAllActiveConnections(context)) {
                try {
                    apiGatewayClient.postToConnection(PostToConnectionRequest.builder()
                            .connectionId(connectionId)
                            .data(SdkBytes.fromUtf8String(jsonPayload))
                            .build());
                } catch (Exception e) {
                    context.getLogger().log("Error enviando a la conexión " + connectionId + " (posiblemente cerrada): " + e.getMessage());
                }
            }
        } catch (Exception e) {
            context.getLogger().log("Error general procesando el broadcast de telemetría: " + e.getMessage());
        }
    }

    private List<String> getAllActiveConnections(Context context) {
        List<String> connections = new ArrayList<>();
        try {
            var scanResponse = dynamoDb.scan(software.amazon.awssdk.services.dynamodb.model.ScanRequest.builder()
                    .tableName("ConexionesWebSocket")
                    .build());
            for (Map<String, software.amazon.awssdk.services.dynamodb.model.AttributeValue> item : scanResponse.items()) {
                if (item.containsKey("connectionId")) {
                    connections.add(item.get("connectionId").s());
                }
            }
        } catch (Exception e) {
            context.getLogger().log("Error escaneando la tabla ConexionesWebSocket: " + e.getMessage());
        }
        return connections;
    }
}
