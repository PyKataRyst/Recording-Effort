import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import { SafeStorage } from '../utils/SafeStorage';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        // Attempt to clear potentially corrupted data
        if (confirm('This will clear all local data to try to fix the issue. Are you sure?')) {
            SafeStorage.clear();
            window.location.reload();
        }
    };

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
                    <div className="max-w-md w-full bg-card border border-destructive/20 rounded-2xl p-8 shadow-2xl shadow-destructive/5 text-center space-y-6">
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
                            <p className="text-muted-foreground text-sm">
                                The application encountered an unexpected error.
                            </p>
                            {this.state.error && (
                                <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono text-left overflow-auto max-h-32 mt-4 break-all border border-border">
                                    {this.state.error.message}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3 pt-2">
                            <button
                                onClick={this.handleReload}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-12 rounded-xl font-medium hover:bg-primary/90 transition-all"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Reload Application
                            </button>

                            <button
                                onClick={this.handleReset}
                                className="w-full flex items-center justify-center gap-2 bg-card border border-border text-muted-foreground h-12 rounded-xl font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear Data & Reset
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
