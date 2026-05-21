import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cuervo-backend-production.up.railway.app';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  const abrirEscaner = async () => {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Ingresa tu email antes de escanear el QR.');
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permiso requerido',
          'Se necesita acceso a la cámara para escanear el QR del evento.'
        );
        return;
      }
    }

    setScanned(false);
    setShowScanner(true);
  };

  const onQRLeido = async ({ data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setShowScanner(false);

    let eventId = data.trim();

    // Si el QR contiene una URL, extrae el último segmento como event_id
    // Ej: https://cuervo-backend-production.up.railway.app/event/test-event-01 → test-event-01
    try {
      const url = new URL(eventId);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) eventId = segments[segments.length - 1];
    } catch {
      // No es URL, usar el texto directamente
    }

    if (!eventId) {
      Alert.alert('QR inválido', 'No se pudo leer el ID del evento.');
      return;
    }

    await registrarYSuscribir(eventId);
  };

  const registrarYSuscribir = async (eventId) => {
    const emailLimpio = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      Alert.alert('Email inválido', 'Por favor ingresa un email válido.');
      return;
    }

    const pushToken = await AsyncStorage.getItem('pushToken');
    if (!pushToken) {
      Alert.alert(
        'Token no disponible',
        'No se pudo obtener el token de notificaciones. Asegúrate de tener un dispositivo físico y permisos activos, luego reinicia la app.'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Registrar / actualizar usuario con token FCM
      await axios.post(`${API_URL}/api/auth/register`, {
        email: emailLimpio,
        firebase_token: pushToken,
      });

      // 2. Suscribir al evento escaneado
      await axios.post(`${API_URL}/api/events/${eventId}/subscribe`, {
        email: emailLimpio,
      });

      await AsyncStorage.setItem('userEmail', emailLimpio);

      Alert.alert(
        '¡Listo!',
        `Te suscribiste al evento.\nRecibirás notificaciones cuando el organizador las envíe.`,
        [
          { text: 'Ver notificaciones', onPress: () => navigation.navigate('Notifications') },
          { text: 'Escanear otro', style: 'cancel' },
        ]
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Error de conexión. Verifica tu internet.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🐦‍⬛</Text>
          <Text style={styles.title}>Cuervo</Text>
          <Text style={styles.subtitle}>
            Ingresa tu email y escanea el QR del evento para recibir notificaciones
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={abrirEscaner}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📷  Escanear QR del Evento</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Notifications')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Ver notificaciones recibidas →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal del escáner QR */}
      <Modal visible={showScanner} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.scannerWrapper}>
          <Text style={styles.scannerTitle}>Apunta al código QR del evento</Text>

          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : onQRLeido}
            />
            {/* Marco guía */}
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
            </View>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const SCAN_FRAME = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  linkText: {
    color: '#6366f1',
    fontSize: 14,
  },

  // Scanner
  scannerWrapper: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 17,
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: SCAN_FRAME,
    height: SCAN_FRAME,
    borderWidth: 3,
    borderColor: '#6366f1',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 24,
    marginVertical: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
