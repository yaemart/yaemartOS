import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IamModule } from '../iam/casbin.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductKnowledgeIndexerService } from './product-knowledge-indexer.service';
import { ListingDraftIndexerService } from './listing-draft-indexer.service';
import { KeywordCorpusIndexerService } from './keyword-corpus-indexer.service';
import { FaqKnowledgeService } from './faq-knowledge.service';

@Module({
  imports: [IamModule, AiModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    ProductKnowledgeIndexerService,
    ListingDraftIndexerService,
    KeywordCorpusIndexerService,
    FaqKnowledgeService,
  ],
  exports: [
    SearchService,
    FaqKnowledgeService,
    ProductKnowledgeIndexerService,
    ListingDraftIndexerService,
    KeywordCorpusIndexerService,
  ],
})
export class SearchModule {}
