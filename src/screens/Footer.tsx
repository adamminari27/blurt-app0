import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, View } from 'react-native';

export function DonateFooter() {
  return (
    <View style={styles.footerContainer}>
      <TouchableOpacity 
        style={styles.glowButton} 
        onPress={() => Linking.openURL('https://paypal.me/JesulemAdamEbol')}
      >
        <Text style={styles.buttonText}>Donate !</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  glowButton: {
    backgroundColor: '#8a2be2',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: 'center',
    marginVertical: 15,
    // iOS Glow
    shadowColor: '#8a2be2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    // Android Glow
    elevation: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});