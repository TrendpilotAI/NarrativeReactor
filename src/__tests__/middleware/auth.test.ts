import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../../middleware/auth';

function makeReq(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { res, status, json };
}

describe('apiKeyAuth middleware', () => {
    const next: NextFunction = jest.fn();
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('when API_KEY is set', () => {
        beforeEach(() => {
            process.env.API_KEY = 'secret-key';
        });

        it('allows requests with the correct API key', () => {
            const req = makeReq({ 'x-api-key': 'secret-key' });
            const { res } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('rejects requests with wrong API key (401)', () => {
            const req = makeReq({ 'x-api-key': 'wrong-key' });
            const { res, status, json } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(401);
            expect(json).toHaveBeenCalledWith({ error: 'Invalid API key' });
        });

        it('rejects requests with no API key header (401)', () => {
            const req = makeReq({});
            const { res, status, json } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(401);
            expect(json).toHaveBeenCalledWith({ error: 'Missing X-API-Key header' });
        });
    });

    describe('when API_KEY is NOT set in production', () => {
        beforeEach(() => {
            delete process.env.API_KEY;
            process.env.NODE_ENV = 'production';
        });

        it('rejects ALL requests with 503 (fail closed)', () => {
            const req = makeReq({ 'x-api-key': 'any-key' });
            const { res, status, json } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(503);
            expect(json).toHaveBeenCalledWith({ error: 'Service not configured — API_KEY required' });
        });

        it('rejects requests with no key with 503 (fail closed)', () => {
            const req = makeReq({});
            const { res, status, json } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(503);
        });
    });

    describe('when API_KEY is NOT set in development', () => {
        beforeEach(() => {
            delete process.env.API_KEY;
            process.env.NODE_ENV = 'development';
        });

        it('allows all requests (dev convenience) with a warning', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const req = makeReq({});
            const { res } = makeRes();
            apiKeyAuth(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });
});
