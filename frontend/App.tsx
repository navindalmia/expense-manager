// import { StatusBar } from 'expo-status-bar';
// import { StyleSheet, Text, View } from 'react-native';

// export default function App() {
//   return (
//     <View style={styles.container}>
//       <Text>Open up App.tsx to start working on your app!</Text>
//       <StatusBar style="auto" />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });

// import { Text, View } from 'react-native';

// export default function App() {
//   return (
//     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//       <Text>lets start the fun! 👋</Text>
//     </View>
//   );
// }

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/types/navigation';
import HomeScreen from './src/screens/HomeScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
// import ExpenseDetailScreen from './src/screens/ExpenseDetailScreen';
// import CreateExpenseScreen from './src/screens/CreateExpenseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

console.log("Frontend API Base URL:", process.env.EXPO_PUBLIC_API_BASE_URL);

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerBackTitle: 'Back',
        }}
        initialRouteName="Home"
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ 
            title: 'Expense Groups',
            headerBackVisible: false
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
        {/* TODO: Add ExpenseDetailScreen and CreateExpenseScreen components */}
        {/* <Stack.Screen 
          name="ExpenseDetail" 
          component={ExpenseDetailScreen}
          options={{ title: 'Expense Details' }}
        />
        <Stack.Screen 
          name="CreateExpense" 
          component={CreateExpenseScreen}
          options={{ title: 'Add Expense' }}
        /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
