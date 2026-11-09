# --- ETAPA 1: Construcción y Compilación con Maven ---
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# --- ETAPA 2: Imagen final para AWS Lambda Java 21 ---
FROM public.ecr.aws/lambda/java:21
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=build /app/target/classes ./
COPY --from=build /app/target/*.jar ./lib/
CMD [ "com.kafka.mensajero.WebSocketConnectHandler::handleRequest" ]
