import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './app/index';
import {
  configureImageDiskCache,
  trimImageDiskCacheOnce,
} from './src/lib/imageCache';

configureImageDiskCache();

export default function App() {
  useEffect(() => {
    void trimImageDiskCacheOnce();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <HomeScreen />
    </>
  );
}
