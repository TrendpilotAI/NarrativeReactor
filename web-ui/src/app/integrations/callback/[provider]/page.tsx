'use client';

import { connectSocialAccountAction } from "../../../actions";

export default function IntegrationCallback() {
    const { provider } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const finalizeConnection = async () => {
            const code = searchParams.get('oauth_verifier') || searchParams.get('code');
            const state = searchParams.get('oauth_token') || searchParams.get('state');
            const verifier = localStorage.getItem(`verifier_${provider as string}`);

            if (!code || !verifier) {
                setError('Missing authentication parameters');
                return;
            }

            try {
                const result = await connectSocialAccountAction(
                    provider as string,
                    code,
                    verifier
                );

                if (result?.success) {
                    localStorage.removeItem(`verifier_${provider as string}`);
                    router.push('/integrations?status=success');
                } else {
                    setError('Failed to connect account');
                }
            } catch (err) {
                setError('Network error connecting account');
            }
        };

        finalizeConnection();
    }, [provider, searchParams, router]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 p-6">
                <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-2xl max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/integrations')}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors"
                    >
                        Back to Integrations
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <div className="text-center">
                <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Finalizing Connection</h2>
                <p className="text-slate-400">Please wait while we sync your {provider} account...</p>
            </div>
        </div>
    );
}
