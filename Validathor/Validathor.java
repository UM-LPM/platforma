/******************************************************************************
 *  Compilation:  javac Validathor.java
 *  Execution:    java Validathor [programyouwanttocompile.java] [path_to_output_directory]
 *
 *  Tries to compile inputed java class.
 *
 *
 ******************************************************************************/
import java.util.*;
import java.io.*;

public class Validathor {

	private static PrintWriter writer;
	private static StringBuilder errors;

	
	private static void startProcess(ProcessBuilder pb) throws IOException {
		Process p = pb.start();
		BufferedReader stdError = new BufferedReader(new InputStreamReader(p.getErrorStream()));
		String s = null;
		StringBuilder sb = new StringBuilder();
		while ((s = stdError.readLine()) != null) {
			errors.append(s);
		}
	}

	public static void main(String[] args) {
		errors = new StringBuilder();
		if (args.length == 2) {
			String targetFile = args[1];
			String userAlgorithmFolder = new File(args[0]).getParentFile().toString();
			String earsPath = new File(args[0]).getParentFile().getParentFile().getParentFile().getParentFile().getParentFile().toString()+"/EARS/ears.jar";
			String userAlgorithmFilename = new File(args[0]).getName().toString();
			
			System.out.println(earsPath);
			
			try {
			ProcessBuilder pb = new ProcessBuilder("javac","-sourcepath",userAlgorithmFolder,"-cp",earsPath,userAlgorithmFilename);

			pb.directory(new File(userAlgorithmFolder));
			startProcess(pb);

			} catch (Exception e) {
				e.printStackTrace();
				return;
			}


			try {
			
				ProcessBuilder pb;
				pb = new ProcessBuilder("java","-cp",earsPath+File.pathSeparator+userAlgorithmFolder+"/",userAlgorithmFilename.substring(0, userAlgorithmFilename.lastIndexOf(".")));
			} catch (Exception e) {
				e.printStackTrace();
			}
			
			try( PrintWriter out = new PrintWriter(targetFile) )
			{
				out.println("{\"error_list\": \""+errors.toString().replaceAll("\"","\\\\\"")+"\"}");
			} catch(Exception b) {}
		} else
			System.out.println(
					"Error, invalid startup. Run the program with command: \njava Validathor [programyouwanttocompile.java] [path_to_output_directory]");
	}
}