import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProductKnowledgeIndexerService } from './product-knowledge-indexer.service';
import { ListingDraftIndexerService } from './listing-draft-indexer.service';
import { KeywordCorpusIndexerService } from './keyword-corpus-indexer.service';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    ProductKnowledgeIndexerService,
    ListingDraftIndexerService,
    KeywordCorpusIndexerService,
  ],
  exports: [
    SearchService,
    ProductKnowledgeIndexerService,
    ListingDraftIndexerService,
    KeywordCorpusIndexerService,
  ],
})
export class SearchModule {}
