import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AccountScreen, { ArticleScreen, EnquireScreen, HelpScreen, OrdersScreen, PageScreen, WishlistScreen } from "./src/screens/AccountScreen";
import AuthScreen from "./src/screens/AuthScreen";
import BagScreen from "./src/screens/BagScreen";
import { AddressesScreen, CheckoutScreen, OrderScreen, ProfileScreen } from "./src/screens/CommerceScreens";
import HomeScreen from "./src/screens/HomeScreen";
import ProductScreen from "./src/screens/ProductScreen";
import ShopScreen from "./src/screens/ShopScreen";
import { StoreProvider, useStore } from "./src/store";
import { colors } from "./src/ui";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const { theme, footer } = useStore();
  const icons = footer || {};
  const anyIcon = icons.home || icons.favourite || icons.profile;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none", width: 0, height: 0 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarActiveTintColor: theme.accent || colors.maroon,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: theme.paper || colors.paper, borderTopColor: colors.line },
      }}
    >
      {(icons.home || !anyIcon) ? <Tab.Screen name="Home" component={HomeScreen} /> : null}
      {icons.favourite ? <Tab.Screen name="Favourite" component={WishlistScreen} /> : null}
      {icons.profile ? <Tab.Screen name="Profile" component={AccountScreen} /> : null}
    </Tab.Navigator>
  );
}

function Root() {
  const { theme } = useStore();
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerTintColor: colors.ink, headerStyle: { backgroundColor: theme.background || colors.ivory } }}>
            <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="SignIn" component={AuthScreen} options={{ title: "Sign in" }} />
            <Stack.Screen name="Shop" component={ShopScreen} options={{ title: "Shop" }} />
            <Stack.Screen name="Product" component={ProductScreen} options={{ title: "" }} />
            <Stack.Screen name="Bag" component={BagScreen} options={{ title: "Bag" }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Saved" }} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "Orders" }} />
            <Stack.Screen name="Order" component={OrderScreen} options={{ title: "Order" }} />
            <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: "Addresses" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Your details" }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help" }} />
            <Stack.Screen name="Page" component={PageScreen} options={{ title: "" }} />
            <Stack.Screen name="Article" component={ArticleScreen} options={{ title: "" }} />
            <Stack.Screen name="Enquire" component={EnquireScreen} options={{ title: "Desk" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
