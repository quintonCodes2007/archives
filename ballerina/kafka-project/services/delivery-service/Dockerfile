FROM ballerina/ballerina:2201.13.4 AS builder

WORKDIR /home/ballerina/app

COPY --chown=ballerina:ballerina . .

RUN bal build


FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /home/ballerina/app/target/bin/*.jar app.jar

CMD ["java", "-jar", "app.jar"]