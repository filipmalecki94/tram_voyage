'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function TableIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const codeTrimmed = code.trim().toUpperCase();

  function handleGo() {
    if (codeTrimmed.length < 4) return;
    router.push(`/table/${codeTrimmed}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-sm mx-auto">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Tramwajarz</h1>
        <p className="text-muted-foreground mt-2">Widok stołu</p>
      </div>

      <section className="w-full rounded-xl border bg-card p-4 flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="code">
          Kod pokoju
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleGo()}
          placeholder="np. ABC123"
          maxLength={8}
          autoFocus
          className="h-12 rounded-lg border border-input bg-background px-3 text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          className="h-12 text-base w-full"
          disabled={codeTrimmed.length < 4}
          onClick={handleGo}
        >
          Otwórz stół
        </Button>
      </section>
    </main>
  );
}
