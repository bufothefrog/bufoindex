import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Playlist Sync privacy policy',
  description: 'What data Playlist Sync accesses, why, and where it is kept.',
  robots: { index: false },
};

export default function PlaylistSyncPrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Playlist Sync privacy policy</CardTitle>
          <CardDescription>Last updated 2026-11-22</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Playlist Sync is a personal tool used only by the owner of this site, for their own
            accounts. It has no other users.
          </p>
          <h2 className="font-semibold text-foreground">What it accesses</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">YouTube:</strong> permission to manage the
              owner&apos;s YouTube playlists, used only to read those playlists, add videos to them
              and create new ones. It does not upload, delete or edit videos, comments or channel
              settings.
            </li>
            <li>
              <strong className="text-foreground">Spotify:</strong> read-only access to the
              owner&apos;s playlists, used only to read the song list of the playlist being synced.
            </li>
          </ul>
          <h2 className="font-semibold text-foreground">What it stores</h2>
          <p>
            Sign-in tokens are kept as private settings in the owner&apos;s own cloud environment. A
            record of which video was added for which song is kept in the owner&apos;s private code
            repository. Nothing is sold, shared, used for advertising, or sent to any other party.
          </p>
          <h2 className="font-semibold text-foreground">Google user data</h2>
          <p>
            Playlist Sync&apos;s use of information received from Google APIs adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-primary underline-offset-4 hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <h2 className="font-semibold text-foreground">Removing access</h2>
          <p>
            Access can be revoked at any time from the Google account permissions page or the
            Spotify account apps page. Revoking it stops the tool immediately.
          </p>
          <p>
            <Link href="/playlist-sync" className="text-primary underline-offset-4 hover:underline">
              About Playlist Sync
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
