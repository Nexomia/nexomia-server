import { Test, TestingModule } from '@nestjs/testing'
import { EmojisController } from './emojis.controller'

describe('EmojisController', () => {
  let controller: EmojisController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmojisController],
    }).compile()

    controller = module.get<EmojisController>(EmojisController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
