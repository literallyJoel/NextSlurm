import { useFormContext } from "react-hook-form";
import { motion } from "framer-motion";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface Props {
  name: string;
  index: number;
  tenantId?: string;
}

export const ProviderForm = ({ name, index }: Props) => {
  const { control } = useFormContext();

  return (
    <motion.div className="flex w-full flex-col  gap-4">
      <span className="pt-2 text-lg font-semibold text-fuchsia-800">
        {name}
      </span>

      <FormField
        control={control}
        name={`providers[${index}].clientId`}
        render={({ field }) => (
          <FormItem>
            <div className="flex w-full flex-row items-center justify-between">
              <FormLabel>Client ID</FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`providers[${index}].clientSecret`}
        render={({ field }) => (
          <FormItem>
            <div className="flex w-full flex-row items-center justify-between">
              <FormLabel>Client Secret</FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <Input type="password" {...field} />
            </FormControl>
            <FormDescription>
              Secrets are encrypted before being stored in your database.
            </FormDescription>
          </FormItem>
        )}
      />

      {name === "Microsoft" && (
        <FormField
          control={control}
          name={`providers[${index}].tenantId`}
          render={({ field }) => (
            <FormItem>
              <div className="flex w-full flex-row items-center justify-between">
                <FormLabel>Tenant ID</FormLabel>
                <FormMessage />
              </div>
              <FormControl>
                <Input {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </motion.div>
  );
};
