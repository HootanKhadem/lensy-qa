import { test as base, expect, Page, Browser, BrowserContext, TestInfo, VideoMode } from '@playwright/test';

type RoleFixtures = {
  adminPage: Page;
  customerPage: Page;
};

// `video`, `trace`, and `screenshot` in the project's `use` block are NOT real
// `BrowserContextOptions` — they're pseudo-options that Playwright's own built-in
// `context`/`page` test fixtures translate into a real `recordVideo: { dir }` value (and
// decide whether to keep the resulting file) inside their internal `_contextFactory` fixture
// (node_modules/playwright/lib/index.js, roughly lines 355-414). `browser.newContext()` —
// which these role fixtures call directly — is playwright-core's raw API; it has no idea what
// `video`/`trace`/`screenshot` mean, so spreading `...testInfo.project.use` into it (still
// correct and needed for everything else `use` declares) silently drops video recording.
// `videoModeFor` / `shouldCaptureVideo` / `shouldKeepVideo` below reimplement just the video
// half of that internal logic (mirroring `normalizeVideoMode` / `shouldCaptureVideo` /
// `shouldPreserveVideo` in the file above) so `video: 'retain-on-failure'` behaves the same for
// these fixtures as it does for Playwright's built-in ones: always record, but only keep and
// attach the recording when the test actually fails.

function videoModeFor(testInfo: TestInfo): VideoMode | 'off' {
  const video = testInfo.project.use.video;
  if (!video) return 'off';
  const mode = typeof video === 'string' ? video : video.mode;
  // 'retry-with-video' is a deprecated alias for 'on-first-retry'.
  return mode === 'retry-with-video' ? 'on-first-retry' : mode;
}

function shouldCaptureVideo(videoMode: VideoMode | 'off', testInfo: TestInfo): boolean {
  return (
    videoMode === 'on' ||
    videoMode === 'retain-on-failure' ||
    videoMode === 'retain-on-failure-and-retries' ||
    (videoMode === 'on-first-retry' && testInfo.retry === 1) ||
    (videoMode === 'on-all-retries' && testInfo.retry > 0) ||
    (videoMode === 'retain-on-first-failure' && testInfo.retry === 0)
  );
}

function shouldKeepVideo(videoMode: VideoMode | 'off', testInfo: TestInfo): boolean {
  const testFailed = testInfo.status !== testInfo.expectedStatus;
  switch (videoMode) {
    case 'on':
    case 'on-first-retry':
    case 'on-all-retries':
      return true;
    case 'retain-on-failure':
    case 'retain-on-first-failure':
      return testFailed;
    case 'retain-on-failure-and-retries':
      return testFailed || testInfo.retry > 0;
    default:
      return false;
  }
}

async function newRoleContext(browser: Browser, testInfo: TestInfo, storageState: string) {
  const videoMode = videoModeFor(testInfo);
  const captureVideo = shouldCaptureVideo(videoMode, testInfo);
  if (captureVideo) {
    // testInfo.outputDir is created lazily by outputPath(), not on first read — force it into
    // existence now since recordVideo needs the directory to exist before the context opens.
    testInfo.outputPath();
  }
  const context = await browser.newContext({
    ...testInfo.project.use,
    storageState,
    recordVideo: captureVideo ? { dir: testInfo.outputDir } : undefined,
  });
  return { context, videoMode, captureVideo };
}

async function closeRoleContext(
  context: BrowserContext,
  page: Page,
  testInfo: TestInfo,
  videoMode: VideoMode | 'off',
  captureVideo: boolean,
) {
  await context.close();
  if (!captureVideo) return;
  const video = page.video();
  if (!video) return;
  if (shouldKeepVideo(videoMode, testInfo)) {
    await testInfo.attach('video', { path: await video.path(), contentType: 'video/webm' });
  } else {
    // Mirrors the built-in fixture's behavior for passing runs under 'retain-on-failure':
    // the video was recorded (we don't know the outcome until now) but isn't kept.
    await video.delete().catch(() => {});
  }
}

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use, testInfo) => {
    const { context, videoMode, captureVideo } = await newRoleContext(browser, testInfo, 'storage/admin.json');
    const page = await context.newPage();
    await use(page);
    await closeRoleContext(context, page, testInfo, videoMode, captureVideo);
  },
  customerPage: async ({ browser }, use, testInfo) => {
    const { context, videoMode, captureVideo } = await newRoleContext(browser, testInfo, 'storage/customer.json');
    const page = await context.newPage();
    await use(page);
    await closeRoleContext(context, page, testInfo, videoMode, captureVideo);
  },
});

export { expect };
