import { File, FileSchema } from './schemas/file.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: File.name, schema: FileSchema },
    ]),
    MulterModule.register({
      dest: './upload',
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService]
})
export class FilesModule {}
