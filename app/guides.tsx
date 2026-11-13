import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Button, Card, Eyebrow, H1, P, Page, Row, Seo } from '../components/ui';
import { publicTeam } from '../lib/api';
import { colors } from '../lib/theme';
import type { Profile } from '../lib/types';

type Guide = Pick<Profile, 'id' | 'full_name' | 'bio' | 'photo_url' | 'team_type'>;

export default function Guides() {
  const [rows, setRows] = useState<Guide[] | null>(null);
  useEffect(() => { publicTeam().then(setRows); }, []);
  return (
    <Page>
      <Seo title="Port O'Connor fishing guides" path="/guides"
        description="Meet the Port O'Connor fishing guides behind POC Premier Lodge trips: bay, wade, jetty and drift fishing for redfish, speckled trout and black drum." />
      <Eyebrow>Guided fishing</Eyebrow>
      <H1>Our guides</H1>
      <P muted>Local captains who fish Matagorda Bay, Espiritu Santo Bay and the jetties every week. Book a trip and the office matches you with the right guide for the day.</P>
      <View style={{ gap: 12, marginTop: 16 }}>
        {(rows ?? []).map((g) => (
          <Card key={g.id} style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {g.photo_url ? <Image source={{ uri: g.photo_url }} style={{ width: 96, height: 96, borderRadius: 6, backgroundColor: colors.sand }} /> : null}
            <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
              <Text role="heading" style={{ fontSize: 22, color: colors.navy }}>{g.full_name || 'Guide'}</Text>
              <P>{g.bio || 'Port O’Connor fishing guide.'}</P>
            </View>
          </Card>
        ))}
        {rows && !rows.length ? <P muted>Guide profiles are coming soon.</P> : null}
      </View>
      <Row style={{ marginTop: 18 }}><Button title="Book a fishing trip" href="/search?kind=trip" /></Row>
    </Page>
  );
}
