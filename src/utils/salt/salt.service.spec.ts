import { Test, TestingModule } from '@nestjs/testing'
import { SaltService } from './salt.service'

describe('SaltService', () => {
  let service: SaltService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SaltService],
    }).compile()

    service = module.get<SaltService>(SaltService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
