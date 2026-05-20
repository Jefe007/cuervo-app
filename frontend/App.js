import React, { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RegisterScreen from './screens/RegisterScreen';
import NotificationsScreen from './screens/NotificationsScreen';

// Cómo manejar notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    obtenerTokenPush();

    // Guardar notificación en AsyncStorage cuando llega con la app abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const { title, body } = notification.request.content;
        await guardarNotificacion({ title, body });
      }
    );

    // Cuando el usuario toca la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[Notif] Tap en notificación:', response.notification.request.content.title);
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Register"
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0a0a0a' },
        }}
      >
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: 'Cuervo' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Notificaciones' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

async function obtenerTokenPush() {
  if (!Device.isDevice) {
    console.warn('[Push] Se necesita un dispositivo físico para push notifications');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Permiso requerido',
      'Activa las notificaciones en Configuración para recibir avisos de eventos.'
    );
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Cuervo',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  try {
    // getExpoPushTokenAsync funciona en Expo Go para pruebas.
    // En producción con build standalone usa getDevicePushTokenAsync() para FCM directo.
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'REEMPLAZA_CON_TU_EXPO_PROJECT_ID',
    });

    await AsyncStorage.setItem('pushToken', tokenData.data);
    console.log('[Push] Token guardado:', tokenData.data.slice(0, 30) + '...');
  } catch (err) {
    console.error('[Push] Error al obtener token:', err.message);
  }
}

async function guardarNotificacion({ title, body }) {
  try {
    const stored = JSON.parse((await AsyncStorage.getItem('notifications')) || '[]');
    const nueva = {
      id: Date.now().toString(),
      title: title || '(Sin título)',
      body: body || '',
      receivedAt: new Date().toISOString(),
    };
    const actualizado = [nueva, ...stored].slice(0, 50); // máximo 50
    await AsyncStorage.setItem('notifications', JSON.stringify(actualizado));
  } catch (err) {
    console.error('[Storage] Error guardando notificación:', err.message);
  }
}
