import GoodBadButtons from '@/components/good-bad-buttons';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 bg-background">
      <div className="text-center mb-10 sm:mb-16">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground mb-3 sm:mb-4">
          Good or Bad Sounds
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Press a button to hear a sound!
        </p>
      </div>
      <GoodBadButtons />
    </main>
  );
}
