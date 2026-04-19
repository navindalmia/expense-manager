import React, { useRef, useEffect } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/types/navigation';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import CreateExpenseScreen from './src/screens/CreateExpenseScreen';
import EditExpenseScreen from './src/screens/EditExpenseScreen';
import { SettlementScreen } from './src/screens/SettlementScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { setOnUnauthorized } from './src/api/http/interceptors';
// import ExpenseDetailScreen from './src/screens/ExpenseDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

console.log("Frontend API Base URL:", process.env.EXPO_PUBLIC_API_BASE_URL);

/**
 * Navigation Stack
 * Shows Login screen if user is not authenticated
 * Shows Home stack if user is authenticated
 */
function AppNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { isAuthenticated, isHydrating } = useAuth();

  /**
   * Register 401 callback for token expiration handling
   * When interceptor detects 401, redirect to login screen
   */
  useEffect(() => {
    if (navigationRef.current) {
      setOnUnauthorized(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      });
    }
  }, []);

  // Show nothing while hydrating auth state from storage
  if (isHydrating) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerBackTitle: 'Back',
        }}
        initialRouteName={isAuthenticated ? 'Home' : 'Login'}
      >
        {/* Auth screens */}
        {!isAuthenticated ? (
          <Stack.Group
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Group>
        ) : (
          // App screens (only shown when authenticated)
          <Stack.Group>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                title: 'Expense Groups',
                headerBackVisible: false,
              }}
            />
            <Stack.Screen
              name="ExpenseList"
              component={ExpenseListScreen}
              options={{ title: 'Group Expenses' }}
            />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ title: 'Create Group' }}
            />
            <Stack.Screen
              name="CreateExpense"
              component={CreateExpenseScreen}
              options={{ title: 'Add Expense' }}
            />
            <Stack.Screen
              name="EditExpense"
              component={EditExpenseScreen}
              options={{ title: 'Edit Expense' }}
            />
            <Stack.Screen
              name="Settlement"
              component={SettlementScreen}
              options={{ title: 'Settlement Breakdown' }}
            />
            {/* TODO: Add ExpenseDetailScreen component */}
            {/* <Stack.Screen 
              name="ExpenseDetail" 
              component={ExpenseDetailScreen}
              options={{ title: 'Expense Details' }}
            /> */}
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Main App Component
 * Wraps with AuthProvider to provide auth context globally
 */
export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
