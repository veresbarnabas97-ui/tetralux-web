/**
 * TetraLux Presale Integration (Anchor-based)
 * Replace the presaleBuy() function in index.html with this
 */

// Add these dependencies to your HTML <head>:
// <script src="https://unpkg.com/@coral-xyz/anchor@0.28.0/dist/anchor.umd.js"></script>
// <script src="https://unpkg.com/@solana/spl-token@0.3.8/lib/index.iife.min.js"></script>

const PRESALE_IDL = {
  // Paste your actual Anchor IDL here from target/idl/your_program.json
  version: "0.1.0",
  name: "tetralux_presale",
  instructions: [
    {
      name: "buyTokens",
      accounts: [
        { name: "buyer", isSigner: true, isWritable: true },
        { name: "buyerTokenAccount", isSigner: false, isWritable: true },
        { name: "presaleTokenAccount", isSigner: false, isWritable: true },
        { name: "presaleConfig", isSigner: false, isWritable: true },
        { name: "tokenProgram", isSigner: false, isWritable: false },
        { name: "systemProgram", isSigner: false, isWritable: false }
      ],
      args: [
        { name: "solAmount", type: "u64" }
      ]
    }
  ]
};

async function presaleBuy(solAmount) {
  const buyBtn = document.getElementById('buy-btn');
  buyBtn.setAttribute('aria-busy', 'true');
  buyBtn.disabled = true;
  buyBtn.innerText = 'Processing...';
  buyBtn.classList.add('animate-pulse');

  try {
    if (!window.solana || !userPublicKey) {
      throw new Error('Wallet not connected');
    }

    showNotification('Preparing transaction...', 'info');

    const connection = new window.solanaWeb3.Connection(CONFIG.RPC_URL);
    
    // 1. Create Anchor Provider
    const provider = {
      connection,
      publicKey: new window.solanaWeb3.PublicKey(userPublicKey),
      signTransaction: async (tx) => {
        const signed = await window.solana.signTransaction(tx);
        return signed;
      },
      signAllTransactions: async (txs) => {
        return await window.solana.signAllTransactions(txs);
      }
    };

    // 2. Ensure buyer has associated token account
    const TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey(
      'TokenkegQfeZyiNwAJsyFbPVwwQQfuj5WNvxKX2B5C' // SPL Token Program
    );
    const ASSOCIATED_TOKEN_PROGRAM_ID = new window.solanaWeb3.PublicKey(
      'ATokenGPvbdGVqstVQmcLsNZAqeEBZvUKeS5apSnUUp9J'
    );

    const mint = new window.solanaWeb3.PublicKey(CONFIG.TOKEN_MINT);
    const buyerPublicKey = new window.solanaWeb3.PublicKey(userPublicKey);

    // Derive Buyer's Associated Token Account
    const buyerTokenAccount = window.solanaWeb3.PublicKey.findProgramAddressSync(
      [
        buyerPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

    showNotification('Building transaction...', 'info');

    // 3. Create Transaction
    const lamports = Math.floor(solAmount * window.solanaWeb3.LAMPORTS_PER_SOL);
    const transaction = new window.solanaWeb3.Transaction();

    // Add SOL transfer instruction (presale contract receives SOL)
    transaction.add(
      window.solanaWeb3.SystemProgram.transfer({
        fromPubkey: buyerPublicKey,
        toPubkey: new window.solanaWeb3.PublicKey(CONFIG.ADMIN_WALLET),
        lamports: lamports
      })
    );

    // 4. Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = buyerPublicKey;

    // 5. Sign & Send
    showNotification('Signing transaction...', 'info');
    const signed = await window.solana.signTransaction(transaction);
    
    showNotification('Sending transaction...', 'info');
    const signature = await connection.sendRawTransaction(signed.serialize());

    // 6. Confirm
    showNotification('Confirming transaction...', 'info');
    await connection.confirmTransaction(signature, 'confirmed');

    // 7. Update UI
    const tlxAmount = solAmount * CONFIG.EXCHANGE_RATE;
    const currentSold = parseInt(document.getElementById('sold-amount').textContent.replace(/,/g, '')) || 0;
    const newSold = currentSold + tlxAmount;
    
    updateProgressBar(newSold, CONFIG.PRESALE_CAP);
    document.getElementById('sol-input').value = '';
    document.getElementById('tlx-output').value = '';

    showNotification(`✓ Success! Sent ${solAmount} SOL\nTx: ${signature.slice(0, 16)}...`, 'success');

  } catch (error) {
    console.error('Presale error:', error);
    showNotification(`Transaction failed: ${error.message}`, 'error');
  } finally {
    buyBtn.setAttribute('aria-busy', 'false');
    buyBtn.disabled = false;
    buyBtn.innerText = 'Buy TLX';
    buyBtn.classList.remove('animate-pulse');
  }
}
