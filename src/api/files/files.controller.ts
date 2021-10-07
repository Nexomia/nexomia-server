import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { DUser } from 'decorators/user.decorator'
import { FileInterceptor } from '@nestjs/platform-express'
import { AccessToken } from './../../interfaces/access-token.interface'
import { FilesService } from './files.service'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':fileId/:fileName')
  async getFIle(@Param() params, @Res() res) {
    return this.filesService.getFile(params.fileId, params.fileName, res)
  }

  @Get(':fileId/:fileName/preview')
  async getFIlePreview(@Param() params, @Res() res) {
    return this.filesService.getFile(params.fileId, params.fileName, res, true)
  }

  @Get('upload_server')
  async getServer(
    @Query('file_type') fileType: number,
    @DUser() user: AccessToken,
  ) {
    return this.filesService.getFileServer(fileType, user.id)
  }

  @Post(':fileId')
  @UseInterceptors(FileInterceptor('file'))
  async file(
    @Param('fileId') fileId,
    @UploadedFile() file: Express.Multer.File,
    @DUser() user: AccessToken,
  ) {
    return this.filesService.uploadFile(file, fileId, user.id)
  }
}
