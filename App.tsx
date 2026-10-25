import React from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './app/index';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <HomeScreen />
    </>
  );
}
