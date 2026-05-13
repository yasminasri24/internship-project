import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const id = await AsyncStorage.getItem('userID');
      const role = await AsyncStorage.getItem('role');

      if (!id) router.replace('/auth');
      else if (role === 'superadmin') router.replace('/sadmindashboard');
      else router.replace('/home');
    };

    check();
  }, []);

  return null;
}

