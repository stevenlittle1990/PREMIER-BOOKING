import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FeedCard } from '../../components/Community';
import { Button, H1, P, Page, Seo } from '../../components/ui';
import { feedItem, type FeedItem } from '../../lib/api';
import { useAuth } from '../../lib/auth';

// One post or review: the page a shared link opens.
export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isAdmin } = useAuth();
  const [item, setItem] = useState<FeedItem | null | undefined>(undefined);
  const load = () => { if (id) feedItem(String(id)).then(setItem); };
  useEffect(load, [id]);
  return (
    <Page>
      <Seo title="From the Port O'Connor community" description="Photos, catches and reviews from guests of POC Premier Lodge and our fishing guides." />
      <View style={{ maxWidth: 620, width: '100%', alignSelf: 'center', gap: 14 }}>
        {item === undefined ? <P muted>Loading…</P> : item === null ? (
          <><H1>Post not found</H1><P muted>It may have been removed.</P></>
        ) : <FeedCard item={item} me={session?.user.id} isAdmin={isAdmin} onChanged={load} />}
        <Button title="See more in Community" kind="secondary" href="/community" />
        <Button title="Book a trip or a stay" href="/" />
      </View>
    </Page>
  );
}
