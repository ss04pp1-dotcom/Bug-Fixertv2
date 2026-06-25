import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
    await service.flush();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('get / set', () => {
    it('returns null for a missing key', async () => {
      expect(await service.get('nonexistent')).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      await service.set('key1', { foo: 'bar' }, 60_000);
      const val = await service.get<{ foo: string }>('key1');
      expect(val).toEqual({ foo: 'bar' });
    });

    it('returns null after TTL expires', async () => {
      await service.set('expiring', 'value', 1); // 1ms TTL
      await new Promise((r) => setTimeout(r, 10));
      expect(await service.get('expiring')).toBeNull();
    });

    it('handles primitive values', async () => {
      await service.set('num', 42, 60_000);
      await service.set('bool', true, 60_000);
      await service.set('str', 'hello', 60_000);
      expect(await service.get('num')).toBe(42);
      expect(await service.get('bool')).toBe(true);
      expect(await service.get('str')).toBe('hello');
    });
  });

  describe('del()', () => {
    it('removes a key', async () => {
      await service.set('del-me', 'value', 60_000);
      await service.del('del-me');
      expect(await service.get('del-me')).toBeNull();
    });

    it('does nothing for nonexistent key', async () => {
      await expect(service.del('ghost')).resolves.not.toThrow();
    });
  });

  describe('delByPrefix()', () => {
    it('removes all keys with matching prefix', async () => {
      await service.set('cats:1', 'a', 60_000);
      await service.set('cats:2', 'b', 60_000);
      await service.set('users:1', 'c', 60_000);

      const count = await service.delByPrefix('cats:');
      expect(count).toBe(2);
      expect(await service.get('cats:1')).toBeNull();
      expect(await service.get('cats:2')).toBeNull();
      expect(await service.get('users:1')).toBe('c');
    });
  });

  describe('flush()', () => {
    it('clears all cached entries', async () => {
      await service.set('a', 1, 60_000);
      await service.set('b', 2, 60_000);
      await service.flush();
      expect(await service.get('a')).toBeNull();
      expect(await service.get('b')).toBeNull();
      expect(service.size()).toBe(0);
    });
  });

  describe('getOrSet()', () => {
    it('calls factory on cache miss and caches result', async () => {
      const factory = jest.fn().mockResolvedValue({ data: 'fresh' });
      const result = await service.getOrSet('miss-key', factory, 60_000);
      expect(result).toEqual({ data: 'fresh' });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('returns cached value on subsequent calls without calling factory', async () => {
      const factory = jest.fn().mockResolvedValue({ data: 'computed' });
      await service.getOrSet('cached-key', factory, 60_000);
      await service.getOrSet('cached-key', factory, 60_000);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('uses default TTL of 60 seconds', async () => {
      const factory = jest.fn().mockResolvedValue('value');
      await service.getOrSet('default-ttl', factory);
      expect(await service.get('default-ttl')).toBe('value');
    });
  });

  describe('size()', () => {
    it('tracks number of cached entries', async () => {
      expect(service.size()).toBe(0);
      await service.set('k1', 1, 60_000);
      await service.set('k2', 2, 60_000);
      expect(service.size()).toBe(2);
    });
  });
});
