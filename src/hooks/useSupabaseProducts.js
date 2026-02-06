import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { productsService } from "../services/products.service";

export function useSupabaseProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [user]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productsService.getProductsWithSalesHistory(user.id);
      setProducts(data);
    } catch (err) {
      console.error("Error loading products:", err);
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (productData) => {
    try {
      const result = await productsService.saveProduct(user.id, productData);
      if (result.success) {
        await loadProducts();
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      const result = await productsService.updateProduct(productId, user.id, updates);
      if (result.success) {
        await loadProducts();
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteProduct = async (productId) => {
    try {
      const result = await productsService.deleteProduct(productId, user.id);
      if (result.success) {
        await loadProducts();
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    products,
    loading,
    error,
    refresh: loadProducts,
    addProduct,
    updateProduct,
    deleteProduct
  };
}
