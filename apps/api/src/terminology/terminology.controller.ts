import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LocaleCode } from '../generated/prisma';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { CreateTerminologyDto } from './dto/create-terminology.dto';
import { UpdateTerminologyDto } from './dto/update-terminology.dto';
import { TerminologyService } from './terminology.service';

@Controller('terminology')
@UseGuards(CasbinGuard)
export class TerminologyController {
  constructor(private readonly service: TerminologyService) {}

  @Get()
  @RequirePolicy({ obj: 'terminology', act: 'read' })
  list(@Query('brandId') brandId: string, @Query('locale') locale: LocaleCode) {
    return this.service.findByBrandAndLocale(brandId, locale);
  }

  @Post()
  @RequirePolicy({ obj: 'terminology', act: 'write' })
  create(@Body() dto: CreateTerminologyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'terminology', act: 'write' })
  update(@Param('id') id: string, @Body() dto: UpdateTerminologyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePolicy({ obj: 'terminology', act: 'write' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('import')
  @RequirePolicy({ obj: 'terminology', act: 'write' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
    }),
  )
  async importCsv(
    @Query('brandId') brandId: string,
    @Query('locale') locale: LocaleCode,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.importCsv(brandId, locale, file.buffer);
  }
}
