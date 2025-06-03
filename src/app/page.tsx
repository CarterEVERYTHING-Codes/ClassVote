
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import AdminPanel from '@/components/admin-panel';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 sm:p-12 md:p-16 bg-background space-y-8">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground mb-3 sm:mb-4">
          Good or Bad Sounds
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Press a button to hear a sound and cast your vote!
        </p>
      </div>
      
      <Leaderboard />
      
      <div className="mt-8">
        <GoodBadButtonsLoader />
      </div>

      <div className="mt-12 w-full flex justify-center">
        <AdminPanel />
      </div>
    </main>
  );
}
