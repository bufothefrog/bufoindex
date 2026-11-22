import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Playlist Sync',
  description:
    'A personal tool that keeps the owner’s YouTube playlists in step with one of their Spotify playlists.',
  robots: { index: false },
};

export default function PlaylistSyncPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Playlist Sync</CardTitle>
          <CardDescription>A personal tool, not a public service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Playlist Sync keeps a set of YouTube playlists in step with a Spotify playlist. It reads
            the song list from one Spotify playlist and adds a matching official video for each new
            song to the owner&apos;s own YouTube playlists, about once a week.
          </p>
          <p>
            It is run only by the owner of this site, for their own Spotify and YouTube accounts.
            Nobody else can sign in to it or use it.
          </p>
          <p>
            <Link
              href="/playlist-sync/privacy"
              className="text-primary underline-offset-4 hover:underline"
            >
              Privacy policy
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
