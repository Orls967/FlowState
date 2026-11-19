import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  kind?: 'generic' | 'webgl';
}
interface State {
  error: Error | null;
}

function Fallback({ kind, onRetry }: { kind: 'generic' | 'webgl'; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="m-4 max-w-xl border-l-4 border-accent bg-surface p-4">
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <TriangleAlert aria-hidden size={20} className="text-accent" />
        {t('errors.title')}
      </p>
      <p className="mt-2 text-ink-2">{kind === 'webgl' ? t('errors.webgl') : t('errors.generic')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 border-2 border-line-strong px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
      >
        {t('errors.retry')}
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[FlowState]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      const msg = this.state.error.message.toLowerCase();
      const kind = this.props.kind ?? (msg.includes('webgl') ? 'webgl' : 'generic');
      return <Fallback kind={kind} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

/** Deteksi dukungan WebGL sebelum memasang <Canvas>. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
