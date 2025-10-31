import { useCounter } from '@/state/useCounter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function App() {
  const { count, inc, reset } = useCounter();

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold">
            Éditeur — Demo Zustand + Immer + shadcn/ui
          </h1>

          <div className="flex items-center gap-3">
            <Button onClick={inc}>count is {count}</Button>
            <Button variant="secondary" onClick={reset}>
              reset
            </Button>
          </div>

          <p className="text-muted-foreground">
            Edit <code className="font-mono">src/App.tsx</code> and save to test HMR
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
