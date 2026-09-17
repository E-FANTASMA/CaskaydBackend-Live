import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminCreatorSuggestionsController } from './controllers/admin-creator-suggestions.controller';
import { CreatorSuggestionsController } from './controllers/creator-suggestions.controller';
import { CreatorSuggestionsService } from './services/creator-suggestions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    CreatorSuggestionsController,
    AdminCreatorSuggestionsController,
  ],
  providers: [CreatorSuggestionsService],
  exports: [CreatorSuggestionsService],
})
export class CreatorSuggestionsModule {}
