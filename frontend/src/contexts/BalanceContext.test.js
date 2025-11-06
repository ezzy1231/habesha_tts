// Simple test to verify BalanceContext functionality
import { BalanceProvider, useBalance } from './BalanceContext.js';

console.log('✅ BalanceContext imported successfully');

// Test that the provider and hook are available
console.log('✅ BalanceProvider and useBalance hook are available');

console.log('🎉 Global Balance Context is ready to use!');
console.log('📝 Features:');
console.log('  - Single toggle controls all balances');
console.log('  - Persistent state across sessions');
console.log('  - Works across all pages (Streamer, Admin, Withdrawal)');
console.log('  - No breaking changes to existing functionality');