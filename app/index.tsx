import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Premier Booking</Text>
      <Text style={styles.sub}>Fishing guides and places to stay. Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d2233', padding: 24 },
  title: { color: '#fff', fontSize: 40, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#b8c7d4', fontSize: 18, marginTop: 12, textAlign: 'center' },
});
