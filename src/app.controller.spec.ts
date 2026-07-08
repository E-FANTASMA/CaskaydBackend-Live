import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  it('returns a healthy status payload', () => {
    const result = appController.healthCheck();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});
