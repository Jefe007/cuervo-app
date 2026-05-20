import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export default function NotificationsScreen() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const stored = JSON.parse((await AsyncStorage.getItem('notifications')) || '[]');
      setNotificaciones(stored);
    } catch (err) {
      console.error('[Storage] Error cargando notificaciones:', err.message);
    }
  }, []);

  useEffect(() => {
    cargar();

    // Actualiza la lista cuando llega una nueva notificación con la pantalla abierta
    const sub = Notifications.addNotificationReceivedListener(() => {
      setTimeout(cargar, 300); // pequeño delay para que AsyncStorage persista primero
    });

    return () => Notifications.removeNotificationSubscription(sub);
  }, [cargar]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const confirmarLimpiar = () => {
    Alert.alert(
      'Limpiar todo',
      '¿Eliminar todas las notificaciones guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('notifications');
            setNotificaciones([]);
          },
        },
      ]
    );
  };

  const formatearFecha = (iso) => {
    try {
      return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const renderItem = ({ item, index }) => (
    <View style={[styles.card, index === 0 && styles.cardFirst]}>
      <View style={styles.cardAccent} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.cardBody}>{item.body}</Text> : null}
        <Text style={styles.cardDate}>{formatearFecha(item.receivedAt)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {notificaciones.length > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.count}>{notificaciones.length} notificación{notificaciones.length !== 1 ? 'es' : ''}</Text>
          <TouchableOpacity onPress={confirmarLimpiar}>
            <Text style={styles.clearText}>Limpiar todo</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
        contentContainerStyle={notificaciones.length === 0 ? styles.emptyWrapper : styles.listPadding}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptySubtitle}>
              Escanea el QR de un evento y recibirás las notificaciones del organizador aquí
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  count: {
    color: '#666',
    fontSize: 13,
  },
  clearText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  listPadding: {
    paddingVertical: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardFirst: {
    marginTop: 12,
  },
  cardAccent: {
    width: 4,
    backgroundColor: '#6366f1',
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardBody: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardDate: {
    color: '#444',
    fontSize: 12,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
