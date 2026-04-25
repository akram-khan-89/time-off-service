import { NestFactory } from '@nestjs/core';
import { HttpException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation — strips unknown fields, validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Strip fields not in DTO
      forbidNonWhitelisted: true,
      transform: true,         // Auto-transform primitives (string → number etc)
    }),
  );

  // Global exception filter — controls what the client sees
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Time-Off Service running on port ${port}`);
}
bootstrap();