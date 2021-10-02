import { MongooseModule } from '@nestjs/mongoose'
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { File, FileSchema } from './schemas/file.schema'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
    MulterModule.register({
      dest: './upload',
    }),
  ],
  exports: [FilesService, MongooseModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
