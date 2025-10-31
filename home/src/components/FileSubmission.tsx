import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { mockIPFSUpload, ipfsToAddresses } from '../utils/ipfs';
import '../styles/FileApp.css';

export function FileSubmission() {
  const { address } = useAccount();
  const { instance, error } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [cid, setCid] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setCid('');
    setStatus('');
    setName(f?.name || '');
  };

  const onUpload = async () => {
    if (!file) return alert('Select a file first');
    setStatus('Calculating HASH...');
    const cid = await mockIPFSUpload(file);
    setCid(cid);
    setStatus('HASH ready');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance || !address) return alert('Connect wallet');
    if (!file || !cid) return alert('Upload file to Upload IPFS');
    if (!name.trim()) return alert('No file name');
    if (!CONTRACT_ADDRESS) return alert('Contract address not set');

    setIsSubmitting(true);
    setStatus('Encrypting and submitting...');
    try {
      const { addr1, addr2 } = ipfsToAddresses(cid);
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.addAddress(addr1);
      input.addAddress(addr2);
      const enc = await input.encrypt();

      const signer = await signerPromise!;
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await c.submitRecord(name, enc.handles[0], enc.handles[1], enc.inputProof);
      await tx.wait();
      setStatus('Submitted');
      setName('');
      setFile(null);
      setCid('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !isSubmitting && !!cid;
  const missing: string[] = [];
  if (!file) missing.push('file');
  if (!cid) missing.push('CID');

  return (
    <div className="card hover-glow">
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <label style={{
            display: 'block',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'var(--text-inverse)',
            marginBottom: 'var(--spacing-md)',
            letterSpacing: '0.01em'
          }}>
            📤 选择文件上传
          </label>
          <div className="file-upload-area">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onSelectFile}
              id="file-input"
              className="file-input-hidden"
            />
            <label 
              htmlFor="file-input" 
              className="file-upload-label"
            >
              {file ? (
                <div className="file-selected">
                  <div className="file-icon">📄</div>
                  <div className="file-info">
                    <div className="file-name">{name}</div>
                    <div className="file-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFile(null);
                      setName('');
                      setCid('');
                      setStatus('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="file-upload-placeholder">
                  <div className="upload-icon">📎</div>
                  <div className="upload-text">
                    <strong>点击选择文件</strong>
                    <span>或拖拽文件到此处</span>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>
        {file && (
          <div style={{ 
            marginBottom: 'var(--spacing-lg)',
            padding: 'var(--spacing-md)',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              📝 文件名称
            </label>
            <div style={{
              fontSize: '1.05rem',
              color: 'var(--text-inverse)',
              fontWeight: '600',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.1)',
              wordBreak: 'break-word'
            }}>{name}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          <button type="button" onClick={onUpload} disabled={!file}>
            {!file ? '⏳ Upload IPFS' : '🔄 Upload IPFS'}
          </button>
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? '⏳ Submitting...' : '🚀 Submit to Blockchain'}
          </button>
        </div>
        {cid && (
          <div style={{ marginTop: 'var(--spacing-lg)', fontSize: '0.875rem' }}>
            🔗 <strong>Hash:</strong> {cid}
          </div>
        )}
        {!canSubmit && missing.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-md)', fontSize: '0.875rem', color: '#ff6b6b' }}>
            ⚠️ <strong>Missing:</strong> {missing.join(', ')}
          </div>
        )}
        {status && (
          <div style={{
            marginTop: 'var(--spacing-md)',
            fontSize: '0.875rem',
            background: status.includes('Failed') ? 'rgba(255, 107, 107, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: status.includes('Failed') ? '1px solid rgba(255, 107, 107, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            color: status.includes('Failed') ? '#ff6b6b' : '#10b981'
          }}>
            {status.includes('Failed') ? '❌' : status.includes('Submitted') ? '✅' : '🔄'} {status}
          </div>
        )}
        {error && (
          <div style={{
            color: '#ff6b6b',
            marginTop: 'var(--spacing-md)',
            background: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
          }}>
            ❌ {error}
          </div>
        )}
      </form>
    </div>
  );
}
