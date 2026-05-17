async function main() {
  console.log('Running test_429_retry.ts');
  await import('./test_429_retry');
  console.log('Running test_timeout.ts');
  await import('./test_timeout');
  console.log('Running test_malformed_then_repair.ts');
  await import('./test_malformed_then_repair');
  console.log('All tests invoked — please run with `pnpm install` then `pnpm test:llm` (uses tsx)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
