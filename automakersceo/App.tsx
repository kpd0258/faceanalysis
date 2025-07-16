import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import ImprovedCameraScreen from './src/screens/ImprovedCameraScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <ImprovedCameraScreen />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
}); 