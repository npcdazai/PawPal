import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii } from '../theme/colors';
import { typography } from '../theme/typography';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';

export type ScreenName = 'splash' | 'login' | 'register' | 'dashboard';

export const RootNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('splash');
  const [showScreenSwitcher, setShowScreenSwitcher] = useState(false);

  const screens: { id: ScreenName; title: string }[] = [
    { id: 'splash', title: '1. Splash' },
    { id: 'login', title: '2. Login' },
    { id: 'register', title: '3. Register' },
    { id: 'dashboard', title: '4. Dashboard' },
  ];

  return (
    <View style={styles.container}>
      {/* Active Screen */}
      {currentScreen === 'splash' && (
        <SplashScreen onGetStarted={() => setCurrentScreen('login')} />
      )}
      {currentScreen === 'login' && (
        <LoginScreen
          onLoginSuccess={() => setCurrentScreen('dashboard')}
          onNavigateRegister={() => setCurrentScreen('register')}
        />
      )}
      {currentScreen === 'register' && (
        <RegisterScreen
          onRegisterSuccess={() => setCurrentScreen('dashboard')}
          onNavigateLogin={() => setCurrentScreen('login')}
        />
      )}
      {currentScreen === 'dashboard' && <DashboardScreen />}

      {/* Floating Screen Switcher Pill for rapid review & inspection */}
      <View style={styles.floatingSwitcher}>
        {showScreenSwitcher ? (
          <View style={styles.switcherMenu}>
            {screens.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setCurrentScreen(s.id);
                  setShowScreenSwitcher(false);
                }}
                style={[
                  styles.switcherOption,
                  currentScreen === s.id && styles.switcherOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.switcherOptionText,
                    currentScreen === s.id && styles.switcherOptionTextActive,
                  ]}
                >
                  {s.title}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowScreenSwitcher(false)}
              style={styles.switcherClose}
            >
              <Text style={styles.switcherCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowScreenSwitcher(true)}
            style={styles.switcherToggle}
          >
            <Text style={styles.switcherToggleText}>
              📱 {currentScreen.toUpperCase()} ▾
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  floatingSwitcher: {
    position: 'absolute',
    bottom: 82,
    right: 16,
    zIndex: 9999,
  },
  switcherToggle: {
    backgroundColor: colors.inverseSurface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  switcherToggleText: {
    ...typography.labelSm,
    color: colors.inverseOnSurface,
    fontWeight: '700',
  },
  switcherMenu: {
    backgroundColor: colors.inverseSurface,
    borderRadius: radii.md,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  switcherOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  switcherOptionActive: {
    backgroundColor: colors.primary,
  },
  switcherOptionText: {
    ...typography.labelSm,
    color: '#c3c5d8',
    fontWeight: '600',
  },
  switcherOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  switcherClose: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  switcherCloseText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});
