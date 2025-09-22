// import React, { createContext, useContext, useMemo, useReducer } from 'react';
// import { grandTotal } from './calc';

// const initial = {
//   items: [],
//   headerDiscount: 0,
//   serviceCharge: 0,
//   taxConf: { mode: 'percent', value: 0 },
//   payments: [{ method: 'cash', amount: 0, reference: '' }],
//   customerName: '',
//   defaultDiscountType: '%', // default diskon per item
// };

// function reducer(state, action) {
//   switch (action.type) {
//     case 'ADD_ITEM': {
//       const p = action.product;
//       const id = p.id ?? p.product_id;
//       const exist = state.items.find(i => i.id === id);
//       if (exist) {
//         return { ...state, items: state.items.map(i => i.id === id ? { ...i, quantity: (i.quantity||0)+1 } : i) };
//       }
//       return { ...state, items: [...state.items, { ...p, id, quantity: 1, discount_type: state.defaultDiscountType, discount_value: 0 }] };
//     }
//     case 'UPDATE_QTY':
//       return { ...state, items: state.items.map(i => i.id === action.id ? { ...i, quantity: Math.max(1, (i.quantity||1)+action.delta) } : i) };
//     case 'UPDATE_DISCOUNT':
//       return { ...state, items: state.items.map(i => i.id === action.id ? { ...i, ...action.patch } : i) };
//     case 'REMOVE_ITEM':
//       return { ...state, items: state.items.filter(i => i.id !== action.id) };
//     case 'CLEAR':
//       return { ...state, items: [], payments: [{ method: 'cash', amount: 0, reference: '' }] };
//     case 'SET_HEADER':   return { ...state, headerDiscount: action.value };
//     case 'SET_SERVICE':  return { ...state, serviceCharge: action.value };
//     case 'SET_TAX':      return { ...state, taxConf: action.taxConf };
//     case 'SET_PAYMENTS': return { ...state, payments: action.payments };
//     case 'SET_CUSTOMER': return { ...state, customerName: action.name };
//     default: return state;
//   }
// }

// const POSContext = createContext(null);

// export function POSProvider({ children }) {
//   const [state, dispatch] = useReducer(reducer, initial);

//   const actions = useMemo(() => ({
//     addItem: (product) => dispatch({ type: 'ADD_ITEM', product }),
//     updateQty: (id, delta) => dispatch({ type: 'UPDATE_QTY', id, delta }),
//     updateDiscount: (id, patch) => dispatch({ type: 'UPDATE_DISCOUNT', id, patch }),
//     removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', id }),
//     clear: () => dispatch({ type: 'CLEAR' }),
//     setHeaderDiscount: (value) => dispatch({ type: 'SET_HEADER', value }),
//     setServiceCharge: (value) => dispatch({ type: 'SET_SERVICE', value }),
//     setTaxConf: (taxConf) => dispatch({ type: 'SET_TAX', taxConf }),
//     setPayments: (payments) => dispatch({ type: 'SET_PAYMENTS', payments }),
//     setCustomerName: (name) => dispatch({ type: 'SET_CUSTOMER', name }),
//   }), []);

//   const select = useMemo(() => {
//     const sums = grandTotal({
//       items: state.items,
//       headerDiscount: state.headerDiscount,
//       serviceCharge: state.serviceCharge,
//       taxConf: state.taxConf,
//     });
//     return {
//       subtotal: sums.sub,
//       tax: sums.tax,
//       total: sums.total,
//       itemCount: state.items.reduce((n, i) => n + (i.quantity || 0), 0),
//     };
//   }, [state.items, state.headerDiscount, state.serviceCharge, state.taxConf]);

//   return <POSContext.Provider value={{ state, actions, select }}>{children}</POSContext.Provider>;
// }

// export function usePOS() {
//   const ctx = useContext(POSContext);
//   if (!ctx) throw new Error('usePOS must be used within <POSProvider>');
//   return ctx;
// }
