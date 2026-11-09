package com.kafka.streams.DTO;

public class CamionTelemetryDTO {
    private String id;
    private String camionId;
    private Long timestamp;
    private Double temperatura;
    private Double humedad;
    private String estado;

    public void setId(String id) { this.id = id; }
    public String getId() { return this.id; }
    public void setCamionId(String camionId) { this.camionId = camionId; }
    public String getCamionId() { return this.camionId; }
    public void setTimestamp(Long timestamp) { this.timestamp = timestamp; }
    public Long getTimestamp() { return this.timestamp; }
    public void setTemperatura(Double temperatura) { this.temperatura = temperatura; }
    public Double getTemperatura() { return this.temperatura; }
    public void setHumedad(Double humedad) { this.humedad = humedad; }
    public Double getHumedad() { return this.humedad; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getEstado() { return this.estado; }
}
