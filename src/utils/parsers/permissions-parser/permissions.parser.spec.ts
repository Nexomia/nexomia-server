import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsParser } from './permissions.parser';

describe('PermissionsParserService', () => {
  let service: PermissionsParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsParser],
    }).compile();

    service = module.get<PermissionsParser>(PermissionsParser);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
