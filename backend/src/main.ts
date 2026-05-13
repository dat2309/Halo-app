import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { join } from "path";
import { AppModule } from "./app.module";
import * as os from 'os';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve legacy uploads (for posts created before Cloudinary migration).
  // New uploads go to Cloudinary directly; this static handler can be removed
  // once all old `/uploads/...` URLs are migrated or expired.
  app.useStaticAssets(join(__dirname, "..", "uploads"), {
    prefix: "/uploads/",
  });

  // Enable CORS
  app.enableCors({
    origin: "*",
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      stopAtFirstError: true,
    })
  );

  // Global prefix
  app.setGlobalPrefix("api");

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle("Halo App API")
    .setDescription(
      "API documentation for Halo App - Social Feed with Glass UI"
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth"
    )
    .addTag("Auth", "Authentication endpoints")
    .addTag("User", "User management endpoints")
    .addTag("Posts", "Post management endpoints")
    .addTag("Comments", "Comment management endpoints")
    .addTag("Reactions", "Reaction management endpoints")
    .addTag("Calendar", "Calendar event management endpoints")
    .addTag("Finance", "Finance transaction management endpoints")
    .addTag("Upload", "File upload endpoints (Cloudinary)")
    .addTag("Chat", "1-1 chat endpoints")
    .addTag("Call", "Video call endpoints (ICE servers + history)")
    .addTag("Health", "Health check endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const nets = os.networkInterfaces();
  let localIP = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    }
  }
  console.log(`Application is running:`);

  console.log(`→ Local:     http://localhost:${port}`);
  console.log(`→ Network:   http://${localIP}:${port}`);  
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  console.log(`Health check: http://localhost:${port}/api/health`);
}

bootstrap();
