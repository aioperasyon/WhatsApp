import { useState, type FormEvent } from 'react';

interface AccountFormProps {
  busy: boolean;
  onCreate(name: string): Promise<void>;
}

export function AccountForm({ busy, onCreate }: AccountFormProps) {
  const [name, setName] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onCreate(trimmedName);
    setName('');
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="account-name">Hesap adı</label>
        <input
          id="account-name"
          value={name}
          maxLength={80}
          placeholder="Örn. Satış Ekibi"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <button type="submit" disabled={busy || !name.trim()}>
        {busy ? 'Ekleniyor...' : 'Hesap Ekle'}
      </button>
    </form>
  );
}
