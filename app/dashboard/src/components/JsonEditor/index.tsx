import { Box, useColorMode } from "@chakra-ui/react";
import JSONEditor, { JSONEditorMode, JSONEditorOptions } from "jsoneditor";
import "jsoneditor/dist/jsoneditor.css";
import { FC, useEffect, useRef } from "react";
import "./styles.css";
import "./themes.js";

export type JSONEditorProps = {
  onChange: (value: string) => void;
  json: any;
  mode?: JSONEditorMode;
};
export const JsonEditor: FC<JSONEditorProps> = ({
  json,
  onChange,
  mode = "code",
}) => {
  const { colorMode } = useColorMode();
  const options: JSONEditorOptions = {
    mode,
    onChangeText: onChange,
    statusBar: false,
    mainMenuBar: false,
    theme: colorMode === "dark" ? "ace/theme/nord_dark" : "ace/theme/dawn",
  };

  const jsonEditorContainer = useRef<HTMLDivElement>(null);
  const jsonEditorRef = useRef<JSONEditor | null>(null);

  useEffect(() => {
    jsonEditorRef.current = new JSONEditor(
      jsonEditorContainer.current!,
      options
    );

    return () => {
      if (jsonEditorRef.current) jsonEditorRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    if (jsonEditorRef.current) jsonEditorRef.current.update(json);
  }, [json]);

  return (
    <Box
      border="1px solid"
      borderColor="gray.300"
      _dark={{
        borderColor: "gray.500",
      }}
      borderRadius={5}
    >
      <div ref={jsonEditorContainer} />
    </Box>
  );
};
